<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDepartmentOfficerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');

        return [
            'file_number'   => ['required', 'string', 'max:50', Rule::unique('users', 'file_number')],
            'name'          => ['required', 'string', 'max:255'],
            'email'         => ['nullable', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'department_id' => ['required', 'integer',
                Rule::exists('departments', 'id')->where('school_id', $schoolId)],
        ];
    }
}
